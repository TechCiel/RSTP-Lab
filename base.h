#include<cstdio>
#include<queue>
#include<map>
#include<iostream>
#include<set>
#define MAXB 200
#define MAXL 200
using namespace std;

typedef pair<int,int> Pt;

class BPDU
{
public:
	int rid, cost, sid, pid;
	BPDU(int r=0, int c=0, int s=0, int p=0):
		rid(r), cost(c), sid(s), pid(p){}
	bool operator>(const BPDU &b) const
	{
		if (rid==b.rid)
		{
			if (cost==b.cost)
			{
				if (sid==b.sid)
					return pid<b.pid;
				return sid<b.sid;
			}
			return cost<b.cost;
		}
		return rid<b.rid;
	}
	BPDU operator+(int c) const
	{
		return BPDU(rid, cost+c, sid, pid);
	}
	bool is_from(int b,int p) const
	{
		return sid==b&&pid==p;
	}
	string print() const
	{
		char out[20];
		sprintf(out,"(%d %d %d %d)",rid,cost,sid,pid);
		return string(out);
	}
};

class Event
{
public:
	Pt dst;
	BPDU bpdu;
	Event(Pt _p, BPDU _u):
		dst(_p), bpdu(_u){}
};

class LAN
{
public:
	void broadcast(const BPDU &u,Pt nPt) const
	{
		for (set<Pt>::iterator v=toB.begin();v!=toB.end();v++)//ÿ���˿ڵľ�������ÿ���ɴ����Ŷ����յ� 
			if (*v!=nPt)
				events.push(Event(*v,u));
	}
	void link(const Pt &pt)
	{
		toB.insert(pt);
	}
	void disconnect(const Pt &pt)
	{
		toB.erase(pt);
	}
	static bool event_exist()
	{
		return !events.empty();
	}
	static Event event_happens()
	{
		Event cur=events.front();
		events.pop();
		return cur;
	}
private:
	set<Pt> toB;
	static queue<Event> events;
};
queue<Event> LAN::events;
