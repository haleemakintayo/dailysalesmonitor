import os
from pathlib import Path
from django.contrib import admin
from django.urls import path, include, re_path
from django.http import HttpResponse, FileResponse
from django.conf import settings

def index_view(request):
    """Serve React frontend build if present, otherwise welcome message."""
    dist_index = Path(settings.BASE_DIR).parent / 'dist' / 'index.html'
    if dist_index.exists():
        return FileResponse(open(dist_index, 'rb'))
    return HttpResponse(
        "<h1>Daily Sales Monitor API</h1><p>Visit <a href='/api/sales/'>/api/sales/</a> for the API.</p>",
        content_type="text/html"
    )

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('sales.urls')),
    re_path(r'^(?!api/|admin/|static/).*$', index_view),
]
