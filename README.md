# RH-scalp
rh

## Conectare la Claude API

`claude.py` trimite întrebări la Claude și consumă creditele din contul de pe [platform.claude.com](https://platform.claude.com).

### Instalare (o singură dată)

1. Instalează [Python](https://www.python.org/downloads/) (la instalare bifează „Add Python to PATH”).
2. În folderul proiectului rulează:
   ```
   pip install -r requirements.txt
   ```
3. Fă o cheie nouă pe [platform.claude.com/settings/keys](https://platform.claude.com/settings/keys).
4. Copiază `.env.example` într-un fișier numit `.env` (fără `.txt` la final) și pune cheia în locul lui `pune-cheia-aici`.
   `.env` e în `.gitignore`, deci cheia nu ajunge pe GitHub. Nu o trimite nimănui și nu o pune în cod.

### Folosire

```
python claude.py "Explică-mi ce face un RSI"
python claude.py "Găsește erorile din indicator" --fisier ia.txt
python claude.py                                   # mod chat, 'exit' ca să ieși
python claude.py "..." --model claude-sonnet-5-5   # mai ieftin
```

După fiecare răspuns scriptul afișează câți tokeni s-au folosit și costul aproximativ.

| Model | Intrare / 1M tokeni | Ieșire / 1M tokeni |
|---|---|---|
| `claude-opus-5-5` (implicit) | $4 | $20 |
| `claude-sonnet-5-5` | $2 | $10 |
| `claude-haiku-5-5` | $0.10 | $0.50 |

`ia.txt` are cam 95.000 de tokeni, deci trimis la Opus costă ~$0.40 doar intrarea.
