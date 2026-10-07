def find_next(d,q,r,c):
    if not q:return None
    for rr in range(r,len(d.lines)):
        i=d.lines[rr].find(q,c if rr==r else 0)
        if i>=0:return rr,i
    for rr in range(r+1):
        i=d.lines[rr].find(q,0,c if rr==r else len(d.lines[rr]))
        if i>=0:return rr,i
    return None
