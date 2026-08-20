release: python backend/manage.py migrate --noinput && python backend/manage.py collectstatic --noinput
web: gunicorn bamgai.wsgi:application --chdir backend --bind 0.0.0.0:$PORT
