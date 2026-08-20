#!/usr/bin/env bash
# 배포 빌드. Render의 Build Command로 이 파일을 실행한다.
set -o errexit

pip install -r requirements.txt

# 프런트를 백엔드와 같은 출처에서 내보내기 위해 정적 파일을 모아 둔다.
# 다른 사이트에 나눠 올리면 세션 쿠키가 크로스사이트가 되어 Safari에서 로그인이 막힌다.
rm -rf backend/frontend_dist
mkdir -p backend/frontend_dist
cp index.html planner.html config.js ./*.css backend/frontend_dist/
cp -r src assets backend/frontend_dist/

python backend/manage.py collectstatic --noinput
python backend/manage.py migrate --noinput
