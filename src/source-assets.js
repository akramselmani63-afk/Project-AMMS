// Curated names from the machine register shared by the 2025 and 2026-1
// Rapport de Permanence AGRIDIAM workbooks. No incident history or personnel
// information is copied into this public prototype.
export const sourceTitle = 'Rapport de Permanence AGRIDIAM 2025 / 2026-1 · 3-Liste des machines';
const item = (id, name, kind, parentId, sourceCell) => ({
  id, name, kind, parentId, sourceCell, source: sourceTitle,
  status: 'Unknown', criticality: 'Unassessed',
  description: 'Named in the AGRIDIAM machine register. Location grouping follows the report headings; operating state and criticality have not been verified.'
});
const group = (id, name, kind, parentId, sourceCell) => item(id, name, kind, parentId, sourceCell);

export const sourceEquipment = [
  group('EQ-101', 'Production', 'Area', null, '4-Autres listes!M2'),
  group('EQ-102', 'Silos de Stockage Macros', 'System', 'EQ-101', '3-Liste des machines!B1'),
  item('EQ-103', 'Macro B01', 'Machine', 'EQ-102', '3-Liste des machines!B2'),
  item('EQ-104', 'Macro B02', 'Machine', 'EQ-102', '3-Liste des machines!B3'),
  group('EQ-105', 'Silos de Stockage Micros', 'System', 'EQ-101', '3-Liste des machines!C1'),
  item('EQ-106', 'Micro B201', 'Machine', 'EQ-105', '3-Liste des machines!C2'),
  item('EQ-107', 'Micro B202', 'Machine', 'EQ-105', '3-Liste des machines!C3'),
  group('EQ-108', 'Silos de Stockage PF', 'System', 'EQ-101', '3-Liste des machines!D1'),
  item('EQ-109', 'BG11', 'Machine', 'EQ-108', '3-Liste des machines!D2'),
  item('EQ-110', 'BG12', 'Machine', 'EQ-108', '3-Liste des machines!D3'),
  group('EQ-111', 'Distributeur Rotatif', 'System', 'EQ-101', '3-Liste des machines!E1'),
  item('EQ-112', 'RD1', 'Machine', 'EQ-111', '3-Liste des machines!E2'),
  group('EQ-113', 'Elévateurs Produit', 'System', 'EQ-101', '3-Liste des machines!G1'),
  item('EQ-114', 'E1', 'Machine', 'EQ-113', '3-Liste des machines!G2'),
  group('EQ-115', 'Transporteurs Produits', 'System', 'EQ-101', '3-Liste des machines!H1'),
  item('EQ-116', 'DC1', 'Machine', 'EQ-115', '3-Liste des machines!H2'),
  group('EQ-117', 'Système d’Aspiration DONALDSON', 'System', 'EQ-101', '3-Liste des machines!J1'),
  item('EQ-118', 'MHA', 'Machine', 'EQ-117', '3-Liste des machines!J3'),
  group('EQ-119', 'Mélangeur', 'System', 'EQ-101', '3-Liste des machines!K1'),
  item('EQ-120', 'Mélangeur M1', 'Machine', 'EQ-119', '3-Liste des machines!K2'),
  group('EQ-121', 'Balances', 'System', 'EQ-101', '3-Liste des machines!L1'),
  item('EQ-122', 'W1 (2500 kg)', 'Machine', 'EQ-121', '3-Liste des machines!L2'),

  group('EQ-123', 'Conditionnement', 'Area', null, '4-Autres listes!M3'),
  group('EQ-124', 'Ligne de Conditionnement (CONCETTI BGL1)', 'Line', 'EQ-123', '3-Liste des machines!M1'),
  item('EQ-125', 'Armoire électrique', 'Machine', 'EQ-124', '3-Liste des machines!M2'),
  item('EQ-126', 'Trémie de stockage PF (500 kg)', 'Machine', 'EQ-124', '3-Liste des machines!M3'),
  item('EQ-127', 'Vis de dosage grand débit', 'Machine', 'EQ-124', '3-Liste des machines!M4'),
  item('EQ-128', 'Balance (50 kg)', 'Machine', 'EQ-124', '3-Liste des machines!M6'),
  item('EQ-129', 'Imprimante (NOVEX AL92x)', 'Machine', 'EQ-124', '3-Liste des machines!M10'),
  item('EQ-130', 'Magasin stockage sac', 'Machine', 'EQ-124', '3-Liste des machines!M11'),
  item('EQ-131', 'Couseuse (Union Special)', 'Machine', 'EQ-124', '3-Liste des machines!M17'),
  item('EQ-132', 'Contrôleur de poids (BIZARBA)', 'Machine', 'EQ-124', '3-Liste des machines!M21'),
  group('EQ-133', 'Ligne de Conditionnement (CONCETTI BGL2)', 'Line', 'EQ-123', '3-Liste des machines!N1'),
  item('EQ-134', 'Armoire électrique', 'Machine', 'EQ-133', '3-Liste des machines!N2'),
  item('EQ-135', 'Trémie de stockage PF (500 kg)', 'Machine', 'EQ-133', '3-Liste des machines!N3'),
  item('EQ-136', 'Vis de dosage grand débit', 'Machine', 'EQ-133', '3-Liste des machines!N4'),
  item('EQ-137', 'Balance (50 kg)', 'Machine', 'EQ-133', '3-Liste des machines!N6'),
  item('EQ-138', 'Imprimante (NOVEX AL92x)', 'Machine', 'EQ-133', '3-Liste des machines!N10'),
  item('EQ-139', 'Dispositif de déplacement sacs', 'Machine', 'EQ-133', '3-Liste des machines!N13'),
  item('EQ-140', 'Couseuse (Union Special)', 'Machine', 'EQ-133', '3-Liste des machines!N17'),
  item('EQ-141', 'Bande 2 pivotante (convoyeur)', 'Machine', 'EQ-133', '3-Liste des machines!N20'),
  group('EQ-142', 'Palettiseur (CONCETTI PS-3a)', 'System', 'EQ-123', '3-Liste des machines!O1'),
  item('EQ-143', 'Pince de déplacement des sacs', 'Machine', 'EQ-142', '3-Liste des machines!O3'),
  item('EQ-144', 'Convoyeur à bande 1', 'Machine', 'EQ-142', '3-Liste des machines!O5'),
  item('EQ-145', 'Distributeur de palette', 'Machine', 'EQ-142', '3-Liste des machines!O10'),
  group('EQ-146', 'Banderoleuse (Technowrapp)', 'System', 'EQ-123', '3-Liste des machines!P1'),
  item('EQ-147', 'Convoyeur à rouleaux 1', 'Machine', 'EQ-146', '3-Liste des machines!P3'),
  item('EQ-148', 'Barrières de sécurité', 'Machine', 'EQ-146', '3-Liste des machines!P9'),

  group('EQ-149', 'Utilités', 'Area', null, '3-Liste des machines!Q1'),
  item('EQ-150', 'Groupe électrogène VOLVO (440 KVA)', 'Machine', 'EQ-149', '3-Liste des machines!Q6'),
  item('EQ-151', 'Compresseur KARSHER (AS40)', 'Machine', 'EQ-149', '3-Liste des machines!Q5'),
  item('EQ-152', 'Ascenseur LOMAR 2,5 T', 'Machine', 'EQ-149', '3-Liste des machines!Q2'),
  group('EQ-153', 'Armoires électriques (MCR)', 'Area', null, '3-Liste des machines!R1'),
  item('EQ-154', 'MCC-1.1', 'Machine', 'EQ-153', '3-Liste des machines!R2'),
  item('EQ-155', 'CC1', 'Machine', 'EQ-153', '3-Liste des machines!R5'),
  item('EQ-156', 'TGBT2', 'Machine', 'EQ-153', '3-Liste des machines!R4')
];
