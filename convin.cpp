#include <cstdio>
#include <iostream>
using namespace std;
int portb[202];
int porth[202];
int hubp[200005];
int b[200005],p[200005],l[200005],c[200005];
int main()
{
    int m;
    scanf("%d",&m);
    for (int i=1;i<=m;i++)
    {
        scanf("%*s%d%d%d%d",&b[i],&p[i],&l[i],&c[i]);
        portb[b[i]]=max(portb[b[i]],p[i]+1);
        hubp[i]=porth[l[i]]++;
    }
    for (int i=1;i<=200;i++)
        if (portb[i])
            printf("let b%d = new Bridge(%d, \'b%d\', new MAC(%d))\n",i,portb[i],i,i);
    for (int i=1;i<=200;i++)
        if (porth[i])
            printf("let h%d = new Hub(%d, \'h%d\')\n",i,porth[i],i);
    puts("graph.data(graph.save())");
    puts("graph.render()");
    for (int i=1;i<=m;i++)
    {
        printf("connect(b%d.ports[%d], h%d.ports[%d], %d)\n",b[i],p[i],l[i],hubp[i],c[i]);
    }
}
