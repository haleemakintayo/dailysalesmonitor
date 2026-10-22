import os
import mimetypes
from pathlib import Path
from django.contrib import admin
from django.urls import path, include, re_path
from django.http import HttpResponse, FileResponse, Http404
from django.conf import settings

def spa_fallback(request, path=''):
    """
    Serves static assets from the React dist build if requested,
    otherwise serves dist/index.html for client-side SPA routing.
    """
    dist_dir = Path(settings.BASE_DIR).parent / 'dist'
    
    if path:
        requested_file = (dist_dir / path).resolve()
        if requested_file.is_file() and requested_file.is_relative_to(dist_dir.resolve()):
            content_type, _ = mimetypes.guess_type(str(requested_file))
            return FileResponse(open(requested_file, 'rb'), content_type=content_type)
    
    dist_index = dist_dir / 'index.html'
    if dist_index.exists():
        return FileResponse(open(dist_index, 'rb'), content_type='text/html')
        
    return HttpResponse(
        "<h1>Daily Sales Monitor API</h1><p>Visit <a href='/api/sales/'>/api/sales/</a> for the API.</p>",
        content_type="text/html"
    )

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('sales.urls')),
    re_path(r'^(?P<path>(?!api/|admin/|static/).*)$', spa_fallback),
]
