import os
from .crypto import derive_key
from .storage import save_encrypted, load_encrypted
import getpass
import time
import secrets
import string
import threading

AUTO_LOCK_SECONDS = 15
last_action = time.time()
locked = False
key = None

SALT_FILE = "salt.bin"

def reset_timer():
    global last_action
    last_action = time.time()

def lock_vault():
    global locked, key
    key = None
    locked = True

def auto_lock_thread():
    global locked, key
    while True:
        if (time.time() - last_action) > AUTO_LOCK_SECONDS:
            locked = True
            key = None
        time.sleep(0.5)

def getpw(prompt=""):
    return getpass.getpass(prompt)

def init_master():
    global key
    if os.path.exists(SALT_FILE):
        print("Bereits initialisiert.")
        return

    master = getpw("Master-Passwort setzen: ")
    salt = os.urandom(16)
    with open(SALT_FILE, "wb") as f:
        f.write(salt)

    key = derive_key(master, salt)
    save_encrypted(key, {})
    print("Vault initialisiert.")

def unlock():
    global key
    if not os.path.exists(SALT_FILE):
        print("Vault nicht initialisiert.")
        return None

    master = getpw("Master-Passwort: ")
    salt = open(SALT_FILE, "rb").read()

    try:
        key = derive_key(master, salt)
        _ = load_encrypted(key)
        print("Entsperrt.")
        return key
    except:
        print("Falsches Passwort.")
        return None

def cli_loop(key):
    global locked
    locked = False

    print("Befehle:\nlist \nadd <name> \nshow <name> \ndelete <name> \ngenerate \nlock")

    reset_timer()

    t = threading.Thread(target=auto_lock_thread, daemon=True)
    t.start()
    while True:
        if locked:
            print("Auto-Lock aktiviert. Bitte erneut entsperren.")
            key = None
            return

        cmd = input("\nvault> ").strip()
        reset_timer()

        if locked:
            print("AutoLock aktiviert. Bitte erneut entsperren.")
            return

        if cmd == "exit":
            break

        if cmd == "list":
            data = load_encrypted(key)
            for name in data:
                print("-", name)
            reset_timer()

        if cmd.startswith("add "):
            name = cmd[4:]
            user = input("Username: ")
            pw = getpw("Passwort: ")
            data = load_encrypted(key)
            data[name] = {"user": user, "pw": pw}
            save_encrypted(key, data)
            print("Gespeichert.")
            reset_timer()

        if cmd.startswith("show "):
            name = cmd[5:]
            data = load_encrypted(key)
            if name in data:
                print("User:", data[name]["user"])
                print("Passwort:", data[name]["pw"])
            else:
                print("Nicht gefunden.")
            reset_timer()

        if cmd == "generate":
            alphabet = string.ascii_letters + string.digits + "!$%&/()=?#@"
            pw = "".join(secrets.choice(alphabet) for _ in range(16))
            print("Generiertes Passwort: ", pw)
            reset_timer()

        if cmd.startswith("delete "):
            name = cmd[7:]
            data = load_encrypted(key)
            if name in data:
                del data[name]
                save_encrypted(key, data)
                print("Gelöscht: ", name)
            else:
                print("Nicht gefunden.")
            reset_timer()

        if cmd == "lock":
            print("Vault gesperrt.")
            return
