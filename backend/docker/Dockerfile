FROM golang:1.24 AS builder

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build -o /word-to-pdf

FROM alpine:3

COPY --from=builder /app/database/migrations /migrations
COPY --from=builder /word-to-pdf /word-to-pdf

EXPOSE 3030

CMD ["/word-to-pdf"]
