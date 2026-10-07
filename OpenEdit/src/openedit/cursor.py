class Cursor:
    def __init__(self): self.row=0; self.col=0; self.preferred=0
    def clamp(self,d): self.row=max(0,min(self.row,len(d.lines)-1)); self.col=max(0,min(self.col,len(d.lines[self.row])))
    def left(self,d):
        if self.col: self.col-=1
        elif self.row: self.row-=1; self.col=len(d.lines[self.row])
        self.preferred=self.col
    def right(self,d):
        if self.col<len(d.lines[self.row]): self.col+=1
        elif self.row+1<len(d.lines): self.row+=1; self.col=0
        self.preferred=self.col
    def up(self,d):
        if self.row: self.row-=1
        self.col=min(self.preferred,len(d.lines[self.row]))
    def down(self,d):
        if self.row+1<len(d.lines): self.row+=1
        self.col=min(self.preferred,len(d.lines[self.row]))
    def home(self,d): self.col=0; self.preferred=0
    def end(self,d): self.col=len(d.lines[self.row]); self.preferred=self.col
