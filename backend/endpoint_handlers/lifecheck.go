package endpoint_handlers

import (
	"github.com/gofiber/fiber/v2"
)

func LifeCheck(c *fiber.Ctx) error {
	return c.SendString("OK")
}
