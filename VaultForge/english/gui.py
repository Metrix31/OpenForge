import tkinter as tk
from tkinter import simpledialog, messagebox
import sys
import builtins

# Import original CLI
from vaultforge.cli import init_master, unlock, cli_loop, getpw


# -----------------------------
# Output Redirector
# -----------------------------
class Redirector:
    """Redirects print() output into a Tkinter text widget."""
    def __init__(self, widget):
        self.widget = widget

    def write(self, text):
        self.widget.insert(tk.END, text)
        self.widget.see(tk.END)

    def flush(self):
        pass


# -----------------------------
# Tkinter-based input() and getpass()
# -----------------------------
def gui_input(prompt=""):
    """Replacement for input() using a Tkinter dialog."""
    return simpledialog.askstring("Input", prompt)

def gui_getpass(prompt=""):
    """Replacement for getpass() using a masked Tkinter dialog."""
    return simpledialog.askstring("Password", prompt, show="*")


# -----------------------------
# GUI Wrapper
# -----------------------------
class VaultGUI:
    def __init__(self, root):
        self.root = root
        self.root.title("VaultForge – GUI")

        # Output text box
        self.output = tk.Text(root, height=20, width=60, bg="#1e1e1e", fg="#dcdcdc")
        self.output.pack(padx=10, pady=10)

        # Redirect stdout
        sys.stdout = Redirector(self.output)

        # Patch input() and getpass()
        builtins.input = gui_input
        import vaultforge.cli
        vaultforge.cli.getpw = gui_getpass

        # Start vault
        self.start_vault()

    def start_vault(self):
        """Initialize or unlock the vault, then start the CLI loop."""
        init_master()
        key = unlock()
        if key:
            print("GUI started.\n")
            cli_loop(key)
        else:
            messagebox.showerror("Error", "Incorrect password")
            self.root.destroy()


# -----------------------------
# Start GUI
# -----------------------------
if __name__ == "__main__":
    root = tk.Tk()
    gui = VaultGUI(root)
    root.mainloop()
