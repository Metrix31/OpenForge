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
    """Reset the inactivity timer for auto-lock."""
    global last_action
    last_action = time.time()

def lock_vault():
    """Lock the vault and wipe the key from memory."""
    global locked, key
    key = None
    locked = True

def auto_lock_thread():
    """Background thread that locks the vault after inactivity."""
    global locked, key
    while True:
        if (time.time() - last_action) > AUTO_LOCK_SECONDS:
            locked = True
            key = None
        time.sleep(0.5)

def getpw(prompt=""):
    """Password input wrapper."""
    return getpass.getpass(prompt)

def init_master():
    """Initialize the vault by creating a master password and salt."""
    global key
    if os.path.exists(SALT_FILE):
        print("Already initialized.")
        return

    master = getpw("Set master password: ")
    salt = os.urandom(16)
    with open(SALT_FILE, "wb") as f:
        f.write(salt)

    key = derive_key(master, salt)
    save_encrypted(key, {})
    print("Vault initialized.")

def unlock():
    """Unlock the vault by deriving the key from the master password."""
    global key
    if not os.path.exists(SALT_FILE):
        print("Vault not initialized.")
        return None

    master = getpw("Master password: ")
    salt = open(SALT_FILE, "rb").read()

    try:
        key = derive_key(master, salt)
        _ = load_encrypted(key)
        print("Unlocked.")
        return key
    except:
        print("Incorrect password.")
        return None

def cli_loop(k):
    """Main CLI loop for interacting with the vault."""
    global locked, key
    locked = False
    key = k

    print("Commands:\nlist \nadd <name> \nshow <name> \ndelete <name> \ngenerate \nlock")

    reset_timer()

    t = threading.Thread(target=auto_lock_thread, daemon=True)
    t.start()

    while True:
        if locked:
            print("Auto-lock activated. Please unlock again.")
            key = None
            return

        cmd = input("\nvault> ").strip()
        reset_timer()

        if locked:
            print("Auto-lock activated. Please unlock again.")
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
            pw = getpw("Password: ")
            data = load_encrypted(key)
            data[name] = {"user": user, "pw": pw}
            save_encrypted(key, data)
            print("Saved.")
            reset_timer()

        if cmd.startswith("show "):
            name = cmd[5:]
            data = load_encrypted(key)
            if name in data:
                print("User:", data[name]["user"])
                print("Password:", data[name]["pw"])
            else:
                print("Not found.")
            reset_timer()

        if cmd == "generate":
            alphabet = string.ascii_letters + string.digits + "!$%&/()=?#@"
            pw = "".join(secrets.choice(alphabet) for _ in range(16))
            print("Generated password:", pw)
            reset_timer()

        if cmd.startswith("delete "):
            name = cmd[7:]
            data = load_encrypted(key)
            if name in data:
                del data[name]
                save_encrypted(key, data)
                print("Deleted:", name)
            else:
                print("Not found.")
            reset_timer()

        if cmd == "lock":
            print("Vault locked.")
            return
