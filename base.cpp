#include "base.h"

class Bridge
{
public:
	int bid, c[16];
	LAN* l[16];
	int rt_pid;
	BPDU best[16];
	BPDU to_root() const
	{
		if (rt_pid==-1) return 0;
		return best[rt_pid]+c[rt_pid];
	}
	void forward(BPDU u, int nP=-1)
	{
		for (int p=0;p<16;p++)
			if (p!=nP&&l[p])
			{
				u.pid=p;
				if (u>best[p]) best[p]=u;
				l[p]->broadcast(u,Pt(bid,p));
			}
	}
	void init(int id)
	{
		bid=id;
		rt_pid=-1;
		for (int p=0;p<16;p++)
		    best[p]=BPDU(id,0,id,p);
		forward(BPDU(id,0,id,0));
	}
}bridge[MAXB+2];

int main()
{
	freopen("test1.in", "r", stdin);
	// freopen("test.out", "w", stdout);
	LAN *lan=new LAN[MAXL+2];
	int m;
	scanf("%d",&m);
	while (m--)
	{
		char opt[10];
		int B,P;
		scanf("%s%d%d",opt,&B,&P);
		Bridge &b=bridge[B];
		Pt pt(B,P);
		if (opt[0]=='L')
		{
			if (b.l[P])
				b.l[P]->disconnect(pt);
			int L,c;
			scanf("%d%d",&L,&c);
			lan[L].link(pt);
			b.l[P]=lan+L;
			b.c[P]=c;
		}
		else if (opt[0]=='B')
		{
			if (b.l[P])
			{
				b.l[P]->disconnect(pt);
				b.l[P]=NULL;
				b.c[P]=0;
			}
		}
	}
    for (int i=1;i<=MAXB;i++)
		bridge[i].init(i);
	
    while (LAN::event_exist())
    {
        Event cur=LAN::event_happens();
        Bridge &b=bridge[cur.dst.first];
        int p=cur.dst.second;
        BPDU &u=cur.bpdu;
         printf("Bridge %d.%d received %s\n",b.bid,p,u.print().c_str());
        if (b.best[p]>u) continue;
         printf("  The port's best BPDU updated (past: %s )\n",b.best[p].print().c_str());
		b.best[p]=u;
        if (b.rt_pid!=-1&&b.to_root()>u+b.c[p]) continue;
         printf("  The bridge's best BPDU updated (past: %s )\n",b.to_root().print().c_str());
		u.cost+=b.c[p];
		u.sid=b.bid;
		u.pid=p;
		b.rt_pid=p;
         printf("  Forward %s\n",u.print().c_str());
        b.forward(u,p);
    }

    int ans=0;
    for (int bid=1;bid<=MAXB;bid++)
    {
    	bool exist=false;
    	for (int p=0;p<16;p++)
    	    if (bridge[bid].l[p])
				exist=true;
    	if (!exist) continue;
    	const Bridge &b=bridge[bid];
    	 printf("Bridge %d:",bid);
    	 if (b.rt_pid==-1)
		 	printf(" ROOT\n");
    	 else
		 	printf(" cost=%d (RP=%d)\n",b.to_root().cost,b.rt_pid);
    	for (int p=0;p<16;p++)
    	    if (b.l[p])
    	    {
				//printf("%d %d %d ",bid,p,b.l[p]-lan);
    	    	 printf("Port %d -> LAN %d: ",p,b.l[p]-lan);
    	    	if (p==b.rt_pid)
					printf("RP\n");
    	    	else if (b.best[p].is_from(bid,p))
				    printf("DP\n");
				else printf("BP\n"); 
    	    }
    	 printf("\n");
		ans+=b.to_root().cost;
    }
     printf("total cost : %d\n",ans);
	return 0;
}
