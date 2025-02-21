FROM moalhaddar/docx-to-pdf:2.1.0-12

# Update libreoffice
RUN add-apt-repository ppa:libreoffice/ppa \
    && apt-get update \
    && apt-get install -y libreoffice

# Override the max file size
COPY ./application.properties /project/application.properties

CMD ["java", "-jar", "./app.jar", "--spring.config.location=./application.properties"]
