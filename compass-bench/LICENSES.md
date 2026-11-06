# Licences and rights

compass-bench reproduces the statements and scoring of four published tests under their MIT licences and the
propositions of a fifth under the rights note below. The tool itself, its data file assembly, translations,
scoring ports and tests are part of the `funstuff` repository and carry its licence.

## 8values (MIT)

Source: https://github.com/8values/8values.github.io — `questions.js`, `quiz.html` (scoring), `ideologies.js`.

    The MIT License
    
    Copyright (c) 2020 8values. http://8values.github.io.
    
    Permission is hereby granted, free of charge, to any person obtaining a copy
    of this software and associated documentation files (the "Software"), to deal
    in the Software without restriction, including without limitation the rights
    to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
    copies of the Software, and to permit persons to whom the Software is
    furnished to do so, subject to the following conditions:
    
    The above copyright notice and this permission notice shall be included in
    all copies or substantial portions of the Software.
    
    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
    OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
    THE SOFTWARE.

## 6axes (MIT)

Source: https://github.com/6axes/6axes.github.io — `questions.js`, `quiz.html` (scoring). A fork of 8values.

    MIT License
    
    Copyright (c) 2019 6axes
    
    Permission is hereby granted, free of charge, to any person obtaining a copy
    of this software and associated documentation files (the "Software"), to deal
    in the Software without restriction, including without limitation the rights
    to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
    copies of the Software, and to permit persons to whom the Software is
    furnished to do so, subject to the following conditions:
    
    The above copyright notice and this permission notice shall be included in all
    copies or substantial portions of the Software.
    
    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
    OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
    SOFTWARE.

## SapplyValues (MIT)

Source: https://github.com/SapplyValues/SapplyValues.github.io — `questions.js`, `quiz.html` (scoring).

    MIT License
    
    Copyright (C) 2017-2019 8values <https://8values.github.io/>
    Copyright (C) 2020-2021 SapplyValues <https://sapplyvalues.github.io/>
    
    Permission is hereby granted, free of charge, to any person obtaining a copy of
    this software and associated documentation files (the "Software"), to deal in
    the Software without restriction, including without limitation the rights to
    use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
    of the Software, and to permit persons to whom the Software is furnished to do
    so, subject to the following conditions:
    
    The above copyright notice and this permission notice shall be included in all
    copies or substantial portions of the Software.
    
    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
    OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
    SOFTWARE.

## 9Axes (MIT)

Source: https://github.com/9axes/9axes.github.io — `questions.js`, `quiz.html` (draw and scoring).

    From the original 8values:
    
    The MIT License
    
    Copyright (c) 2017 8values. http://8values.github.io.
    
    Permission is hereby granted, free of charge, to any person obtaining a copy
    of this software and associated documentation files (the "Software"), to deal
    in the Software without restriction, including without limitation the rights
    to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
    copies of the Software, and to permit persons to whom the Software is
    furnished to do so, subject to the following conditions:
    
    The above copyright notice and this permission notice shall be included in
    all copies or substantial portions of the Software.
    
    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
    OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
    THE SOFTWARE.

## The Political Compass Test

The 62 propositions are the property of Pace News Ltd (politicalcompass.org) and are reproduced here, as in the
research repositories named below, for the purpose of measuring language models, without a licence from the
rights holder. The author of this repository took that decision and bears its risk. The texts were taken from
`data/templates/pct_propositions.csv` in https://github.com/paul-rottger/llm-values-pct (repository under
CC BY 4.0; the propositions themselves are not the repository authors' work).

The scoring tables (62 × 4 weights per axis and the site constants) were taken from `compass_calc.py` in
https://github.com/h4fide/politicalcompassbot, which carries no licence file; they are measured numbers, cited
with their source, and were checked against 12 website-scored trials published with the 2026 error-budget study
(https://github.com/sletch1/AI-Political-Bias-Research-Paper, `data/raw_trials`; Zenodo 10.5281/zenodo.22968158).
Those 12 trials are used as test fixtures in `compass-bench.test.mjs` and are not part of the tool.

## Translations

The German, Chinese, Japanese and Hindi texts in `compass-bench-items.json` are translations made for this tool
(Maker-Checker, Claude sub-agents, November 2026) and are published under the repository licence for the
MIT-licensed tests; for the Political Compass Test propositions the rights note above applies to them as well.
