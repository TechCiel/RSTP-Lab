#include <cstdio>
#include <cstring>
#include <algorithm>
using namespace std;
int nBridge;
int nSegment;
int nPortBridge[300];
int nPortHub[300];
char portBuffer[1000000];
char edgeBuffer[1000000];
char stateBuffer[1000000];
int main() {
    int bridge, port, segment;
    char role[5];
    while(scanf("%d%d%d%2s", &bridge, &port, &segment, role) == 4) {
        nBridge = max(nBridge, bridge);
        nSegment = max(nSegment, segment);
        nPortBridge[bridge] = max(nPortBridge[bridge], port);
        nPortHub[segment]++;
        sprintf(portBuffer+strlen(portBuffer), "{comboId:%%27b%d%%27,id:%%27b%d-%d%%27,label:%%27b%d-%d%%27,cluster:%%27b%d%%27,style:{lineWidth:20}},", bridge, bridge, port, bridge, port, bridge);
        sprintf(edgeBuffer+strlen(edgeBuffer), "{id:%%27b%d-%d,h%d%%27,source:%%27b%d-%d%%27,target:%%27h%d%%27},", bridge, port, segment, bridge, port, segment);
        sprintf(stateBuffer+strlen(stateBuffer), "graph.setItemState(%%27b%d-%d%%27,%%27role%%27,%%27%s%%27);", bridge, port, (role[0]=='R'?"root":(role[0]=='D'?"designated":(role[0]=='B'?"alternate":"fuck"))));
        sprintf(stateBuffer+strlen(stateBuffer), "graph.setItemState(%%27b%d-%d%%27,%%27state%%27,%%27%s%%27);", bridge, port, (role[0]=='R'?"forward":(role[0]=='D'?"forward":(role[0]=='B'?"discard":"fuck"))));
    }
    printf("https://techciel.github.io/RSTP-Lab/?converted=graph.data({combos:[");
    for(int i=1; i<=nBridge; i++) printf("{id:%%27b%d%%27,label:%%27b%d%%27},",i,i);
    printf("],nodes:[");
    for(int i=1; i<=nSegment; i++) printf("{type:%%27diamond%%27,id:%%27h%d%%27,label:%%27h%d%%27,cluster:%%27h%d%%27},",i,i,i);
    fwrite(portBuffer, sizeof(char), strlen(portBuffer), stdout);
    printf("],edges:[");
    fwrite(edgeBuffer, sizeof(char), strlen(edgeBuffer), stdout);
    printf("]});graph.render();");
    fwrite(stateBuffer, sizeof(char), strlen(stateBuffer), stdout);
    putchar('\n');
}
