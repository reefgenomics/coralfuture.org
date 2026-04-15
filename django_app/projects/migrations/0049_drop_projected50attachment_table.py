# Generated manually - drop legacy table (model no longer exists)

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('projects', '0048_publication_authors_journal'),
    ]

    operations = [
        migrations.RunSQL(
            sql="DROP TABLE IF EXISTS projects_projected50attachment CASCADE;",
            reverse_sql=migrations.RunSQL.noop,
        ),
    ]
