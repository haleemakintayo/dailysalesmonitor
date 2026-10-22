import os
import mimetypes
from pathlib import Path
from django.contrib import admin
from django.urls import path, include, re_path
from django.http import HttpResponse, FileResponse
from django.conf import settings

def spa_fallback(request, path=''):
    """
    Serves static assets from dist or staticfiles if directly requested,
    otherwise serves index.html for client-side SPA routing.
    """
    dist_dir = Path(settings.BASE_DIR).parent / 'dist'
    static_root = Path(settings.STATIC_ROOT)

    if path:
        for base in [dist_dir, static_root]:
            if base.exists():
                requested_file = (base / path).resolve()
                if requested_file.is_file() and requested_file.is_relative_to(base.resolve()):
                    content_type, _ = mimetypes.guess_type(str(requested_file))
                    return FileResponse(open(requested_file, 'rb'), content_type=content_type)

    dist_index = dist_dir / 'index.html'
    if dist_index.exists():
        return FileResponse(open(dist_index, 'rb'), content_type='text/html')

    static_index = static_root / 'index.html'
    if static_index.exists():
        return FileResponse(open(static_index, 'rb'), content_type='text/html')

    return HttpResponse(
        "<h1>Daily Sales Monitor API</h1><p>Visit <a href='/api/sales/'>/api/sales/</a> for the API.</p>",
        content_type="text/html"
    )

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('sales.urls')),
    re_path(r'^(?P<path>(?!api/|admin/|static/).*)$', spa_fallback),
]
