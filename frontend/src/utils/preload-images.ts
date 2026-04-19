const GAME_IMAGE_SOURCES = [
  "/img/background.jpg",
  "/img/jesus.jpg",
  "/img/maria_madalena.jpg",
  "/img/pedro.jpg",
  "/img/judas.jpg",
  "/img/fariseu.jpg",
  "/img/joao.jpg",
  "/img/jose_de_arimateia.jpg",
  "/img/matias.jpg",
  "/img/nicodemos.jpg",
  "/img/o_publicano.jpg",
  "/img/rei_herodes.jpg",
  "/img/safira.jpg",
  "/img/simao_zelote.jpg",
  "/img/soldado_romano.jpg",
  "/img/sumo_sacerdote.jpg",
  "/img/tome.jpg",
  "/img/zaqueu.jpg",
  "/img/ananias.jpg",
];

export const preloadGameImages = (): void => {
  GAME_IMAGE_SOURCES.forEach((source) => {
    const image = new Image();
    image.src = source;
  });
};
