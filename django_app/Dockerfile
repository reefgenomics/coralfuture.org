FROM python:3.11.6

ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

RUN apt-get update && \
    apt-get install -y \
      # For postgresql
      libpq-dev \
      # For leaflet maps
      gdal-bin \
      # For cwsample command
      default-jdk

WORKDIR /usr/src/app

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

# Include CoastWatch Software utilitues
RUN cd /usr/src/ && wget https://www.star.nesdis.noaa.gov/socd/coastwatch/cwf/cwutils-3_8_0_457-linux-x86_64.tar.gz && \
    tar -zxf cwutils-3_8_0_457-linux-x86_64.tar.gz && \
    rm cwutils-3_8_0_457-linux-x86_64.tar.gz
# Retrieve the data
RUN cd /usr/src/ && \
    wget https://www.star.nesdis.noaa.gov/pub/sod/mecb/crw/data/5km/v3.1_op/climatology/nc/ct5km_climatology_v3.1.nc
# Update PATH environment variable
ENV PATH="${PATH}:/usr/src/cwutils_3.8.0.457/bin"
ENV MANPATH="${MANPATH}:/usr/src/cwutils_3.8.0.457/doc/man"

CMD ["sh", "-c", "python manage.py migrate && python manage.py collectstatic --noinput && python manage.py runserver 0.0.0.0:8000"]