// 프런트가 바라볼 백엔드 주소.
//
// 로컬에서는 아무것도 설정하지 않는다. api-client.js가 localhost면 자동으로
// http://localhost:8000 을 쓴다.
//
// GitHub Pages로 배포할 때는 .github/workflows/deploy-pages.yml이 이 파일을
// 덮어써서 실제 백엔드 주소를 넣는다. 빈 문자열을 넣으면 API_BASE가 빈 값이 되어
// 요청이 Pages 도메인으로 날아가므로, 값이 있을 때만 설정해야 한다.
