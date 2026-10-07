from pathlib import Path
class Document:
    def __init__(self, lines=None, path=None): self.lines=lines or ['']; self.path=Path(path) if path else None; self.modified=False
    @classmethod
    def load(cls,path): return cls(Path(path).read_text(encoding='utf-8').split('\n'),path)
    def text(self): return '\n'.join(self.lines)
    def insert(self,r,c,s):
        parts=s.split('\n'); line=self.lines[r]; before,after=line[:c],line[c:]
        if len(parts)==1: self.lines[r]=before+s+after; self.modified=True; return r,c+len(s)
        self.lines[r]=before+parts[0]; self.lines[r+1:r+1]=parts[1:-1]; self.lines.insert(r+len(parts)-1,parts[-1]+after); self.modified=True; return r+len(parts)-1,len(parts[-1])
    def enter(self,r,c): return self.insert(r,c,'\n')
    def backspace(self,r,c):
        if c: self.lines[r]=self.lines[r][:c-1]+self.lines[r][c:]; self.modified=True; return r,c-1
        if r: n=len(self.lines[r-1]); self.lines[r-1]+=self.lines[r]; del self.lines[r]; self.modified=True; return r-1,n
        return r,c
    def delete(self,r,c):
        if c<len(self.lines[r]): self.lines[r]=self.lines[r][:c]+self.lines[r][c+1:]; self.modified=True
        elif r+1<len(self.lines): self.lines[r]+=self.lines[r+1]; del self.lines[r+1]; self.modified=True
        return r,c
