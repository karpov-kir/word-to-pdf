FROM moalhaddar/docx-to-pdf:2.1.0-12

# Update libreoffice
RUN apt remove --purge libreoffice* -y && apt autoclean -y && apt update \
    && wget https://download.documentfoundation.org/libreoffice/stable/24.8.5/deb/x86_64/LibreOffice_24.8.5_Linux_x86-64_deb.tar.gz \
    && tar zxvf LibreOffice_24.8.5_Linux_x86-64_deb.tar.gz \
    && cd LibreOffice_24.8.5.2_Linux_x86-64_deb/DEBS \
    && dpkg -i *.deb \
    && ln -s /opt/libreoffice24.8/program/soffice /usr/bin/libreoffice

# Install fonts
RUN apt-get update && \
    apt install -y fontconfig fonts-noto-cjk fonts-noto-color-emoji fonts-crosextra-carlito fonts-crosextra-caladea fonts-noto fonts-freefont-ttf fonts-liberation fonts-dejavu fonts-cantarell \
    && fc-cache -fv

COPY ./fonts-from-windows-machine.zip /tmp/fonts-from-windows-machine.zip

RUN apt install zip -y \
    && unzip /tmp/fonts-from-windows-machine.zip -d /usr/share/fonts/ \
    && fc-cache -fv \
    && rm /tmp/fonts-from-windows-machine.zip

# Override the max file size
COPY ./application.properties /project/application.properties

CMD ["java", "-jar", "./app.jar", "--spring.config.location=./application.properties"]
