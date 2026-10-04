import tkinter as tk
from tkinter import simpledialog, messagebox
import sys
import builtins

# Original CLI importieren
from vaultforge.cli import init_master, unlock, cli_loop, getpw


# -----------------------------
# Output Redirector
# -----------------------------
class Redirector:
    def __init__(self, widget):
        self.widget = widget

    def write(self, text):
        self.widget.insert(tk.END, text)
        self.widget.see(tk.END)

    def flush(self):
        pass


# -----------------------------
# Tkinter-basierte input() und getpass()
# -----------------------------
def gui_input(prompt=""):
    return simpledialog.askstring("Eingabe", prompt)

def gui_getpass(prompt=""):
    return simpledialog.askstring("Passwort", prompt, show="*")


# -----------------------------
# GUI Wrapper
# -----------------------------
class VaultGUI:
    def __init__(self, root):
        self.root = root
        self.root.title("VaultForge – GUI")

        # Textfeld für Ausgaben
        self.output = tk.Text(root, height=20, width=60, bg="#1e1e1e", fg="#dcdcdc")
        self.output.pack(padx=10, pady=10)

        # stdout umleiten
        sys.stdout = Redirector(self.output)

        # input() und getpass() patchen
        builtins.input = gui_input
        import vaultforge.cli
        vaultforge.cli.getpw = gui_getpass

        # Vault starten
        self.start_vault()

    def start_vault(self):
        init_master()
        key = unlock()
        if key:
            print("GUI gestartet.\n")
            cli_loop(key)
        else:
            messagebox.showerror("Fehler", "Falsches Passwort")
            self.root.destroy()


# -----------------------------
# Start GUI
# -----------------------------
if __name__ == "__main__":
    root = tk.Tk()
    gui = VaultGUI(root)
    root.mainloop()
