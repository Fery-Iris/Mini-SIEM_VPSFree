package helpers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
)

// SendWelcomeEmail sends a welcome email to the newly registered user using Resend.com
func SendWelcomeEmail(toEmail string, verificationLink string) error {
	apiKey := os.Getenv("RESEND_API_KEY")
	if apiKey == "" {
		return fmt.Errorf("RESEND_API_KEY is not set in environment")
	}

	url := "https://api.resend.com/emails"

	payload := map[string]interface{}{
		// Resend defaults to onboarding@resend.dev for testing if no domain is verified
		"from":    "Mini SIEM <noreply@strangemrrusdyone.com>",
		"to":      []string{toEmail},
		"subject": "Welcome to Mini-SIEM - Please Verify Your Email",
		"html":    fmt.Sprintf("<p><strong>Welcome to Mini-SIEM!</strong></p><p>Your account has been successfully created.</p><p>Please click the link below to verify your email address:</p><p><a href='%s'>Verify Email</a></p>", verificationLink),
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return err
	}

	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return fmt.Errorf("failed to send email, Resend API returned status code: %d", resp.StatusCode)
	}

	return nil
}
