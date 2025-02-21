# Word to PDF backend

## Development

- Ensure Docker is running
- Install development certificates
  - Install https://github.com/FiloSottile/mkcert
  - `task install-dev-certs`
- `go mod tidy`
- `task install-tools`
- Add `127.0.0.1 api.word-to-pdf.dev` to the hosts file
- `task start:dev`
  - Starts Docker compose with the required services
  - Starts the server with hot reloading
- `task send-many-sample-convert-requests`

### Examples

```bash
curl -X POST https://api.word-to-pdf.dev/auth/token
curl -X POST https://api.word-to-pdf.dev/convert -F "file=@../samples/sample_1mb.docx"
curl -X POST https://api.word-to-pdf.dev/convert -F "file=@../samples/sample_1mb.doc"
```
