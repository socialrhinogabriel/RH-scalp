"""
Conectare la Claude API (Anthropic) - consumă creditele din contul de pe platform.claude.com.

Cheia API se citește din variabila de mediu ANTHROPIC_API_KEY sau din fișierul .env
din același folder (vezi .env.example). Nu scrie niciodată cheia direct în cod.

Exemple:
    python claude.py "Explică-mi ce face un RSI"
    python claude.py "Găsește erorile din indicator" --fisier ia.txt
    python claude.py                                     # mod chat ('exit' ca să ieși)
    python claude.py "..." --model claude-sonnet-5-5     # mai ieftin
"""

import argparse
import os
import sys
from pathlib import Path

import anthropic

# Preț în $ per 1 milion de tokeni: (intrare, ieșire)
PRETURI = {
    "claude-opus-5-5": (4.00, 20.00),
    "claude-sonnet-5-5": (2.00, 10.00),
    "claude-haiku-5-5": (0.10, 0.50),
}
# Haiku 5.5 e mai scump când cererea depășește 100K tokeni de intrare
PRET_HAIKU_PESTE_100K = (0.50, 2.50)

# Haiku nu are fallback pe server
MODELE_CU_FALLBACK = {"claude-opus-5-5", "claude-sonnet-5-5"}


def incarca_cheia():
    if os.environ.get("ANTHROPIC_API_KEY"):
        return
    env = Path(__file__).with_name(".env")
    if env.exists():
        for linie in env.read_text(encoding="utf-8-sig").splitlines():
            cheie, _, valoare = linie.strip().partition("=")
            if cheie.strip() == "ANTHROPIC_API_KEY" and valoare.strip():
                os.environ["ANTHROPIC_API_KEY"] = valoare.strip().strip("\"'")
                return
    sys.exit(
        "Lipsește cheia API.\n"
        "Copiază .env.example în .env și pune cheia ta de pe platform.claude.com/settings/keys,\n"
        "sau setează variabila de mediu ANTHROPIC_API_KEY."
    )


def cost_estimat(model, usage):
    pret_in, pret_out = PRETURI[model]
    if model == "claude-haiku-5-5" and usage.input_tokens > 100_000:
        pret_in, pret_out = PRET_HAIKU_PESTE_100K
    return (usage.input_tokens * pret_in + usage.output_tokens * pret_out) / 1_000_000


def mesaj_cu_fisiere(text, fisiere):
    parti = []
    for cale in fisiere or []:
        continut = Path(cale).read_text(encoding="utf-8", errors="replace")
        parti.append(f'<fisier nume="{Path(cale).name}">\n{continut}\n</fisier>')
    parti.append(text)
    return "\n\n".join(parti)


def trimite(client, model, mesaje):
    """Trimite conversația, afișează răspunsul pe măsură ce vine și returnează mesajul final."""
    extra = {}
    if model in MODELE_CU_FALLBACK:
        # Dacă modelul refuză cererea din motive de siguranță, serverul o reia pe alt model
        extra = {"betas": ["server-side-fallback-2026-07-01"], "fallbacks": "default"}

    with client.beta.messages.stream(
        model=model,
        max_tokens=64000,
        messages=mesaje,
        **extra,
    ) as stream:
        for text in stream.text_stream:
            print(text, end="", flush=True)
        final = stream.get_final_message()
    print()

    if final.stop_reason == "refusal":
        print("[Cererea a fost refuzată de model.]")
    elif final.stop_reason == "max_tokens":
        print("[Răspunsul a fost tăiat - a atins limita de lungime.]")
    print(
        f"[{final.usage.input_tokens} tokeni intrare, {final.usage.output_tokens} ieșire, "
        f"cost aproximativ ${cost_estimat(model, final.usage):.4f}]"
    )
    return final


def main():
    parser = argparse.ArgumentParser(description="Întreabă-l pe Claude prin API.")
    parser.add_argument("intrebare", nargs="?", help="Întrebarea. Fără ea pornește modul chat.")
    parser.add_argument("--fisier", action="append", help="Fișier atașat la întrebare (se poate repeta).")
    parser.add_argument("--model", default="claude-opus-5-5", choices=sorted(PRETURI))
    args = parser.parse_args()

    incarca_cheia()
    client = anthropic.Anthropic()

    try:
        if args.intrebare:
            trimite(client, args.model, [{"role": "user", "content": mesaj_cu_fisiere(args.intrebare, args.fisier)}])
            return

        print(f"Chat cu {args.model}. Scrie 'exit' ca să ieși.")
        mesaje = []
        fisiere = args.fisier  # se atașează doar la primul mesaj
        while True:
            try:
                text = input("\nTu: ").strip()
            except (EOFError, KeyboardInterrupt):
                break
            if text.lower() in ("exit", "quit", "iesire"):
                break
            if not text:
                continue
            mesaje.append({"role": "user", "content": mesaj_cu_fisiere(text, fisiere)})
            print("\nClaude: ", end="")
            final = trimite(client, args.model, mesaje)
            if final.stop_reason == "refusal":
                mesaje.pop()
                continue
            mesaje.append({"role": "assistant", "content": final.content})
            fisiere = None
    except anthropic.AuthenticationError:
        sys.exit("Cheia API e greșită, ștearsă sau expirată. Fă una nouă pe platform.claude.com/settings/keys.")
    except anthropic.PermissionDeniedError as e:
        sys.exit(f"Cheia nu are acces la această operație: {e.message}")
    except anthropic.RateLimitError:
        sys.exit("Prea multe cereri într-un timp scurt. Mai încearcă peste un minut.")
    except anthropic.APIStatusError as e:
        sys.exit(f"Eroare de la API ({e.status_code}): {e.message}")
    except anthropic.APIConnectionError:
        sys.exit("Nu mă pot conecta la API. Verifică internetul.")


if __name__ == "__main__":
    main()
