#!/usr/bin/env python3
"""
Petit serveur de développement local pour la landing page Lockd.

Identique à `python3 -m http.server`, mais interdit explicitement toute
mise en cache par le navigateur (Cache-Control: no-store) sur chaque
réponse. Sans ça, les navigateurs (et l'outil de prévisualisation)
appliquent leur propre heuristique de cache et continuent d'afficher
d'anciennes versions des pages/scripts après une modification, même
après un rechargement forcé — ce qui a causé plusieurs faux "bugs"
pendant le développement (page de connexion, dashboard admin...).
"""
import http.server
import functools


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()


if __name__ == "__main__":
    port = 4173
    handler = functools.partial(NoCacheHandler, directory=".")
    with http.server.ThreadingHTTPServer(("", port), handler) as httpd:
        print(f"Serving on http://localhost:{port} (no-cache)")
        httpd.serve_forever()
