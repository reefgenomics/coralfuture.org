from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('projects', '0049_drop_projected50attachment_table'),
    ]

    operations = [
        migrations.AddField(
            model_name='project',
            name='view_count',
            field=models.PositiveIntegerField(
                db_index=True,
                default=0,
                help_text='Number of authenticated project detail page loads.',
            ),
        ),
    ]
