# e2e

Real-browser acceptance smoke (mobile 390x844, ko-KR, geolocation 37.4849,126.8963).

    cd e2e && npm i && node smoke.mjs [baseUrl]   # default http://localhost:8081

Prints PASS/FAIL per check + screenshots in `out/`; exit 1 on any FAIL. `PW_CHROMIUM=/path/to/chrome` overrides the browser.
