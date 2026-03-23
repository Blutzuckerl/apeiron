# Voice Architecture Notes

Current product behavior:
- Real room membership is server-authoritative.
- Peer audio uses browser WebRTC in direct P2P mode.
- Signaling currently uses authenticated HTTP endpoints and polling.

Planned production upgrade path:
1. Replace polling signaling with authenticated WebSocket signaling for lower latency and faster ICE exchange.
2. Add TURN credentials and relay fallback for restrictive NATs.
3. Replace direct P2P fan-out with an SFU (for example mediasoup/LiveKit/Janus) so rooms scale beyond small groups.

Why SFU is not embedded in this repository:
- An SFU is a dedicated media server, not a small Express feature.
- It requires RTP routing, codec negotiation, transport management, and separate operational concerns.
- It should be deployed as separate infrastructure and integrated via signaling, not implemented ad hoc in the request/response app layer.
