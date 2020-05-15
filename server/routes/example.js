export default function (server) {

  server.route({
    path: '/api/csvGenerator/example',
    method: 'GET',
    handler() {
      return { time: (new Date()).toISOString() };
    }
  });

}
