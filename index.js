const http = require("http");
const express = require("express");
const Docker = require("dockerode");

const docker = new Docker({ socketPath: "/var/run/docker.sock" });

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
