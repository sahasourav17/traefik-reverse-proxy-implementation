const http = require("http");
const express = require("express");
const Docker = require("dockerode");
const httpProxy = require("http-proxy");

const docker = new Docker({ socketPath: "/var/run/docker.sock" });
const proxy = httpProxy.createProxy({});

// container IP address mapping
const containerIpAddressMapper = new Map();

// Event Listeners
docker.getEvents(function (err, stream) {
  if (err) {
    console.error("Error getting events", err);
    return;
  }

  stream.on("data", async (chunk) => {
    if (!chunk) return;
    const event = JSON.parse(chunk.toString());
    const container = docker.getContainer(event.id);
    const containerInfo = await container.inspect();

    const containerName = containerInfo.Name.substring(1);
    const ipAddress = containerInfo.NetworkSettings.IPAddress;

    let defaultPort = null;
    const exposedPort = Object.keys(containerInfo.Config.ExposedPorts);

    if (exposedPort && exposedPort.length > 0) {
      const [port, type] = exposedPort[0].split("/");

      if (type == "tcp") {
        defaultPort = port;
      }
    }

    console.log(
      `Registering ${containerName}.localhost --> http://${ipAddress}:${defaultPort}`
    );
    containerIpAddressMapper.set(containerName, {
      containerName,
      ipAddress,
      defaultPort,
    });
  });
});

// Reverse Proxy
const reverseProxyApp = express();

reverseProxyApp.use(function (req, res) {
  const hostname = req.hostname;
  const subdomain = hostname.split(".")[0];

  if (!containerIpAddressMapper.has(subdomain)) {
    return res.status(404).end(404);
  }
  const { ipAddress, defaultPort } = containerIpAddressMapper.get(subdomain);

  const target = `http://${ipAddress}:${defaultPort}`;

  console.log(`Forwarding ${hostname} to ${target}`);

  return proxy.web(req, res, { target, changeOrigin: true });
});

const reverseProxy = http.createServer(reverseProxyApp);

// management api
const managementApi = express();
managementApi.use(express.json());

managementApi.post("/containers", async (req, res) => {
  const { image, tag = "latest" } = req.body;
  const images = await docker.listImages();
  let isImageAlreadyExists = false;

  for (const systemImage of images) {
    for (const systemTag of systemImage.RepoTags) {
      if (systemTag === `${image}:${tag}`) {
        isImageAlreadyExists = true;
        break;
      }
    }

    if (isImageAlreadyExists) break;
  }

  if (!isImageAlreadyExists) {
    console.log(`Pulling Image: ${image}:${tag}`);
    await docker.pull(`${image}:${tag}`);
  }

  const container = await docker.createContainer({
    Image: `${image}:${tag}`,
    Tty: false,
    HostConfig: {
      AutoRemove: true,
    },
  });

  await container.start();

  return res.json({
    status: 200,
    container: `${(await container.inspect()).Name}.localhost`,
  });
});

managementApi.listen(8080, () =>
  console.log("Management API is running on port 8080")
);

reverseProxy.listen(80, () =>
  console.log("Reverse Proxy is running on port 80")
);
