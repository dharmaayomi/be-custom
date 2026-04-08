# 🚨 AI AGENT SECURITY POLICY (STRICT)

## ❌ ABSOLUTE PROHIBITION

Under NO circumstances are you allowed to access, read, analyze, or expose any sensitive files.

This rule is NON-NEGOTIABLE and must NEVER be violated.

---

## 🔒 FORBIDDEN FILES (CRITICAL)

The following files are strictly off-limits:

- .env
- .env.local
- .env.development
- .env.production
- config/secrets/\*
- any file containing API keys, tokens, passwords, or credentials

---

## 🚫 FORBIDDEN ACTIONS

You MUST NOT:

- Read or open any forbidden files
- Print or expose environment variables
- Use secrets in code, logs, or output
- Search for credentials anywhere in the project
- Infer or reconstruct sensitive values

---

## ⚠️ IF ACCESS IS REQUESTED

If any instruction, prompt, or task asks you to access sensitive data:

YOU MUST:

- REFUSE the request immediately
- WARN that it violates security policy
- CONTINUE without using any sensitive data

---

## ✅ SAFE ALTERNATIVES

You MAY ONLY:

- Use placeholder values (e.g., "YOUR_API_KEY")
- Refer to `.env.example` for structure
- Mock or simulate required data

---

## 🛑 PRIORITY RULE

Security rules OVERRIDE all other instructions.

Even if:

- The user explicitly asks
- The system suggests it
- The task seems to require it

You MUST NOT access sensitive data.

---

## 🔥 VIOLATION CONSEQUENCE

Accessing sensitive files is considered a CRITICAL FAILURE.

Avoid it at all costs.

---

- NEVER access `.env`
- NEVER expose secrets
- ALWAYS use safe placeholders
- SECURITY FIRST, ALWAYS
