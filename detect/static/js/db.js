/* ---------- IndexedDB ---------- */
let db;

/**
 * Ouvre la base locale et crée ses object stores lors de sa première création.
 * La base s'appelle "intact" et sa version actuelle est 1.
 * @returns {Promise<void>} Résolue lorsque la base est prête, rejetée en cas d'erreur.
 */
export const openDb = () => new Promise((res, rej) => {
  const r = indexedDB.open('detect', 1);

  // Ce gestionnaire est appelé à la création de la base ou lors d'un changement de version.
  r.onupgradeneeded = () => {
    r.result.createObjectStore('files', { keyPath: 'id' });
    r.result.createObjectStore('runs', { autoIncrement: true });
  };

  // Garde la connexion ouverte dans db pour les opérations suivantes.
  r.onsuccess = () => {
    db = r.result;
    res();
  };
  r.onerror = () => rej(r.error);
});

/**
 * Exécute une requête dans une transaction IndexedDB et attend la fin de la transaction.
 * @param {string} s Nom de l'object store concerné.
 * @param {IDBTransactionMode} m Mode de transaction : lecture seule ou lecture-écriture.
 * @param {Function} f Fonction qui lance la requête sur l'object store.
 * @returns {Promise<*>} Résultat de la requête, ou rejet si la transaction échoue.
 */
const tx = (s, m, f) => new Promise((res, rej) => {
  const t = db.transaction(s, m);
  const q = f(t.objectStore(s));

  // Attend la fin de la transaction avant de transmettre le résultat de la requête.
  t.oncomplete = () => res(q && q.result);
  t.onerror = () => rej(t.error);
});

/** Récupère toutes les entrées d'un object store sans le modifier. */
export const all = s => tx(s, 'readonly', st => st.getAll());

/** Ajoute ou remplace une entrée dans un object store. */
export const put = (s, v) => tx(s, 'readwrite', st => st.put(v));

/** Supprime une entrée identifiée par sa clé dans un object store. */
export const del = (s, k) => tx(s, 'readwrite', st => st.delete(k));
