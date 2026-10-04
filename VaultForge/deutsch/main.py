from vaultforge.cli import init_master, unlock, cli_loop

print("VaultForge – Lokaler Passwortmanager")

if not __import__("os").path.exists("salt.bin"):
    init_master()

key = unlock()
if key:
    cli_loop(key)
