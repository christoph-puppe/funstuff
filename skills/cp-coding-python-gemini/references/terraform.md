# Terraform — GCP deploy patterns (Cloud Run + GKE)

Two parallel targets, same app image: `terraform/cloud-run/` (default) and `terraform/gke/`,
each with its own README + `deploy.sh` (build → push → apply). Keep org-provided pieces (org
policies, DNS zones, folders) OUT of TF — document them for the admin instead.

## Gate everything on API enablement + propagation

Enabling an API returns before it is usable — new projects otherwise race into
"API has not been used in project … before or it is disabled":

```hcl
locals {
  services = [
    "aiplatform.googleapis.com",           # Vertex / Gemini
    "run.googleapis.com",                  # Cloud Run
    "artifactregistry.googleapis.com",     # images
    "storage.googleapis.com",              # GCS
    "iam.googleapis.com", "iamcredentials.googleapis.com",
    "sts.googleapis.com",                  # WIF token exchange (CI jobs)
    "cloudresourcemanager.googleapis.com", "serviceusage.googleapis.com",
    "logging.googleapis.com",              # audit logs
    "cloudbuild.googleapis.com",           # gcloud builds submit
    "iap.googleapis.com",                  # IAP
    "cloudscheduler.googleapis.com",       # cron for connector jobs
    "compute.googleapis.com",              # LB / NEGs (Ingress)
  ]
}

resource "google_project_service" "services" {
  for_each           = toset(local.services)
  service            = each.value
  disable_on_destroy = false
}

resource "time_sleep" "services_ready" {
  depends_on      = [google_project_service.services]
  create_duration = "60s"
}
# …and EVERY API-dependent resource carries: depends_on = [time_sleep.services_ready]
```

## One bucket, key-prefix namespacing, globally-unique name

GCS names are global; project ids already are — derive from the project, allow an override:

```hcl
locals {
  bucket = "${var.bucket_prefix != "" ? var.bucket_prefix : var.project_id}-store"
}

resource "google_storage_bucket" "store" {
  name                        = local.bucket
  location                    = var.region
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"
  force_destroy               = false
  versioning { enabled = true }        # tamper-evident history on results/evidence
  lifecycle_rule {                     # transient inputs expire; the rest stays
    condition {
      age            = 30
      matches_prefix = ["inputs/"]
    }
    action { type = "Delete" }
  }
  depends_on = [time_sleep.services_ready]
}
```

Object classes live under prefixes (`catalogs/ results/ evidence/ environments/ inputs/`) — one
bucket, one IAM surface, the app keys storage the same way.

## IAP — Google-managed OAuth only

The OAuth admin APIs shut down 2026-03; never terraform OAuth clients/credentials.

- **Cloud Run:** enable IAP on the service (`--iap` / the TF equivalent); grant users
  `roles/iap.httpsResourceAccessor` (`iap_members` var).
- **GKE:** `BackendConfig` with `iap.enabled: true` and **no** oauthclientCredentials block
  (Google-managed client). Audience for JWT verification:
  `/projects/<number>/global/backendServices/<backend-id>`.
- App-side: set `IAP_AUDIENCE` so the app verifies the signed JWT (see iap_access.py). IAP
  authenticates; the app's allow-list authorizes. Fail closed.

## Identities & jobs

- One runtime SA for the service, least privilege: `roles/aiplatform.user`, object access on the
  one bucket (no project-wide storage roles), `roles/logging.logWriter`.
- Each job CLI = a Cloud Run **Job** from the SAME image with a different command
  (`python -m <son>`), its own SA, invoked by Cloud Scheduler where periodic.
- CI (GitLab) auth via **Workload Identity Federation** + SA impersonation — no exported keys,
  ever. The CLIs mint IAP id-tokens themselves.
- ADC everywhere: metadata server in prod, `gcloud auth application-default login` locally.

## Audit logging

- App audit lines go to stdout → Cloud Logging `_Default` (~30-day retention). When audit
  matters: bump retention (`gcloud logging buckets update _Default --retention-days=400`) or a
  dedicated log bucket + sink (that's what `audit_logging.tf` is for).

## After apply — probe, don't assume

1. Unauthenticated hit on the service URL → **302 to accounts.google.com** (IAP live).
2. A non-allow-listed user → the No-Access page (403), nothing else.
3. Runtime SA → real GCS write (workload identity works).
4. One live Vertex `generateContent` → 200 (IAM + model access; a 403 here = project/model
   access, not routing — see the DEBUG-trace reading order in SKILL.md).
5. `GET /version` reports build + effective posture.
