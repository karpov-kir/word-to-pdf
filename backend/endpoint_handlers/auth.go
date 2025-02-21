package endpoint_handlers

import (
	"fmt"

	"github.com/gofiber/fiber/v2"
	"github.com/karpov-kir/word-to-pdf/backend/auth"
)

func CreateToken(c *fiber.Ctx) error {
	token, err := auth.GenerateJWT()
	if err != nil {
		return fmt.Errorf("failed to generate JWT: %w", err)
	}

	return c.JSON(fiber.Map{
		"accessToken": token,
	})
}
