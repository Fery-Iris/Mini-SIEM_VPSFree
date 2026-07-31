
fetch("http://localhost:3000/api/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: "admin@xrsecurity.com", password: "password" })
}).then(res => res.text().then(text => console.log(res.status, text)))
.catch(console.error);

