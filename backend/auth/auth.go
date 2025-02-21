package auth

import (
	"fmt"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofrs/uuid/v5"
	"github.com/golang-jwt/jwt/v5"
)

var jwtSecret = []byte("word_to_pdf_secret")

func GenerateJWT() (string, error) {
	id, err := uuid.NewV7()
	if err != nil {
		return "", err
	}

	claims := jwt.MapClaims{
		"id":  id.String(),
		"exp": time.Now().Add(time.Hour * 24 * 365 * 100).Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(jwtSecret)
}

func JWTMiddleware() fiber.Handler {
	return func(c *fiber.Ctx) error {
		authHeader := c.Get("Authorization")
		if authHeader == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "Missing access token",
			})
		}

		accessToken := strings.TrimPrefix(authHeader, "Bearer ")
		if accessToken == authHeader {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "Invalid access token format",
			})
		}

		jwtToken, err := jwt.Parse(accessToken, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fiber.ErrUnauthorized
			}
			return jwtSecret, nil
		})

		if err != nil || !jwtToken.Valid {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": fmt.Sprintf("Invalid access token: %s", err),
			})
		}

		jwtTokenClaims, ok := jwtToken.Claims.(jwt.MapClaims)
		if !ok {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": fmt.Sprintf("Invalid access token claims: %T", jwtToken.Claims),
			})
		}

		c.Locals("userId", jwtTokenClaims["id"])
		return c.Next()
	}
}
