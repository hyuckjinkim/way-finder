# e2e

Real-browser acceptance smoke (mobile 390x844, ko-KR, geolocation 37.4849,126.8963).

    cd e2e && npm i && node smoke.mjs [baseUrl]   # default http://localhost:8081

Prints PASS/FAIL per check + screenshots in `out/`; exit 1 on any FAIL. `PW_CHROMIUM=/path/to/chrome` overrides the browser.

Transit is answered from `fixtures/odsay-city.json` (ODsay quota is 30/day project-wide): `api.odsay.com` and transit `POST /v1/routes` are intercepted, and check 4 counts ODsay requests per search. `LIVE_TRANSIT=1 node smoke.mjs` disables interception for one live check (skips 4c and 5).
