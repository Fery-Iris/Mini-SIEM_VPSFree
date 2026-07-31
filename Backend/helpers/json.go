package helpers

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"net/http"
)

func WriteJSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func ReadJSON(r *http.Request, dst any) error {
	defer r.Body.Close()
	return json.NewDecoder(r.Body).Decode(dst)
}

func GenerateAPIKey() string {
	b := make([]byte, 16)
	rand.Read(b)
	return "xr_live_" + hex.EncodeToString(b)
}
