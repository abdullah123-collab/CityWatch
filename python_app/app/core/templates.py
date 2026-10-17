"""
Template engine for CityWatch Jinja2 server-rendered views.

Compatible with both legacy Starlette syntax:
    templates.TemplateResponse("template.html", {"request": request, ...})
and Starlette 1.x / modern FastAPI syntax:
    templates.TemplateResponse(request, "template.html", context)
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

from starlette.requests import Request
from starlette.templating import Jinja2Templates


class CompatibleTemplates(Jinja2Templates):
    def TemplateResponse(self, *args: Any, **kwargs: Any):
        # If first arg is a string (template name), adapt to modern signature
        if args and isinstance(args[0], str):
            name = args[0]
            context = args[1] if len(args) > 1 else kwargs.get("context", {})
            request = (
                context.get("request")
                if isinstance(context, dict)
                else kwargs.get("request")
            )
            status_code = kwargs.get("status_code", 200)
            headers = kwargs.get("headers")
            media_type = kwargs.get("media_type")
            background = kwargs.get("background")
            return super().TemplateResponse(
                request=request,
                name=name,
                context=context,
                status_code=status_code,
                headers=headers,
                media_type=media_type,
                background=background,
            )
        return super().TemplateResponse(*args, **kwargs)


_templates_dir = Path(__file__).resolve().parent.parent / "templates"
templates = CompatibleTemplates(directory=str(_templates_dir))
