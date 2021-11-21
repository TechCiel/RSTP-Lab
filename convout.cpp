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
        sprintf(portBuffer+strlen(portBuffer), "{comboId:\'b%d\',id:\'b%d-%d\',label:\'b%d-%d\',cluster:\'b%d\',style:{lineWidth:20}},", bridge, bridge, port, bridge, port, bridge);
        sprintf(edgeBuffer+strlen(edgeBuffer), "{id:\'b%d-%d,h%d\',source:\'b%d-%d\',target:\'h%d\'},", bridge, port, segment, bridge, port, segment);
        sprintf(stateBuffer+strlen(stateBuffer), "graph.setItemState(\'b%d-%d\',\'role\',\'%s\');", bridge, port, (role[0]=='R'?"root":(role[0]=='D'?"designated":(role[0]=='B'?"alternate":"fuck"))));
        sprintf(stateBuffer+strlen(stateBuffer), "graph.setItemState(\'b%d-%d\',\'state\',\'%s\');", bridge, port, (role[0]=='R'?"forward":(role[0]=='D'?"forward":(role[0]=='B'?"discard":"fuck"))));
    }
    printf("graph.data({combos:[");
    for(int i=1; i<=nBridge; i++) printf("{id:\'b%d\',label:\'b%d\'},",i,i);
    printf("],nodes:[");
    for(int i=1; i<=nSegment; i++) printf("{type:\'diamond\',id:\'h%d\',label:\'h%d\',cluster:\'h%d\'},",i,i,i);
    fwrite(portBuffer, sizeof(char), strlen(portBuffer), stdout);
    printf("],edges:[");
    fwrite(edgeBuffer, sizeof(char), strlen(edgeBuffer), stdout);
    printf("]});graph.render();exit();");
    fwrite(stateBuffer, sizeof(char), strlen(stateBuffer), stdout);
    putchar('\n');
}
