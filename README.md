# traefik-reverse-proxy-implementation

Let's first understand what problem, we are trying to solve

### Problem:

Traditionally, when creating Docker containers, we need to manually map container ports to host ports.This manual port mapping requires keeping track of which host ports are already in use.It can become complex and error-prone, especially when dealing with multiple containers.

### Solution:

Our approach eliminates the need for manual port mapping when creating containers. Instead, we utilize Docker's internal networking where each container gets its own IP address. We've implemented a system that:

1. Listens for Docker events to automatically detect when new containers are created.
2. Inspects new containers to retrieve their internal IP addresses and exposed ports.
3. Registers this information in a mapping (containerIpAddressMapper).
4. Sets up a reverse proxy that routes traffic based on subdomains (e.g., containername.localhost) to the appropriate container's internal IP and port.

This method allows developers to create containers without worrying about port conflicts or remembering port allocations. It provides a consistent access pattern via subdomains and significantly simplifies the process of spinning up multiple containers, especially in development environments.
