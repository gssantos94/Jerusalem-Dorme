import type { RoleAbilities } from "../types/game";

export const ROLE_ABILITIES: RoleAbilities = {
  jesus: [
    {
      id: "jesus_revive",
      label: "Carta: Ressuscitar",
      icon: "✨",
      actionType: "jesus_revive",
      oneTime: true,
      requiresDead: true,
    },
  ],
  maria_madalena: [
    {
      id: "maria_cuida",
      label: "Maria Cuida",
      icon: "💖",
      actionType: "maria_cuida",
    },
  ],
  pedro: [
    {
      id: "pedro_protege",
      label: "Pedro Protege",
      icon: "🛡️",
      actionType: "pedro_protege",
    },
  ],
  simao_zelote: [
    {
      id: "simao_elimina",
      label: "Simão Elimina",
      icon: "⚔️",
      actionType: "simao_elimina",
      oneTime: true,
    },
  ],
  matias: [
    {
      id: "matias_escolhe",
      label: "Matias Substitui",
      icon: "🔄",
      actionType: "matias_escolhe",
      oneTime: true,
    },
  ],
  fariseu: [
    {
      id: "sombra_ataca",
      label: "Sombra Ataca",
      icon: "🗡️",
      actionType: "sombra_ataca",
    },
  ],
  sumo_sacerdote: [
    {
      id: "sombra_ataca",
      label: "Sombra Ataca",
      icon: "🗡️",
      actionType: "sombra_ataca",
    },
  ],
  rei_herodes: [
    {
      id: "sombra_ataca",
      label: "Sombra Ataca",
      icon: "🗡️",
      actionType: "sombra_ataca",
    },
  ],
  soldado_romano: [
    {
      id: "sombra_ataca",
      label: "Sombra Ataca",
      icon: "🗡️",
      actionType: "sombra_ataca",
    },
  ],
  judas: [],
  ananias: [],
  safira: [],
  joao: [],
  tome: [],
  nicodemos: [],
  jose_de_arimateia: [],
  zaqueu: [],
  o_publicano: [],
};
