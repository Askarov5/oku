# Worker fixtures

Generate a 2-page sample PDF for local/CI verification:

```bash
python -c "from tests.test_raster_mock import _make_pdf_bytes; open('fixtures/sample.pdf','wb').write(_make_pdf_bytes())"
```
