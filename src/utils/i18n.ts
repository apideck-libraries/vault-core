import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// the translations
// (tip move them in a JSON file and import them,
// or even better, manage them separated from your code: https://react.i18next.com/guides/multiple-translation-files)
const resources = {
  en: {
    translation: {
      Added: 'Added',
      Available: 'Available',
      'Manage your integrations': 'Manage your integrations',
      'No integrations found': 'No integrations found',
      'No integrations have been added yet':
        'It looks like the application owner did not yet make any integrations available',
      'No connections': 'No connections',
      'Search integrations': 'Search integrations',
      'Needs configuration': 'Needs configuration',
      'Invalid configuration': 'Invalid configuration',
      'Not connected': 'Not connected',
      Disabled: 'Disabled',
      Unauthorized: 'Unauthorized',
      'Input required': 'Input required',
      Connected: 'Connected',
      Loading: 'Loading',
      'Select..': 'Select..',
      Example: 'Example',
      'Select field': 'Select field',
      'Select custom field': 'Select custom field',
      'Enter a field mapping.': 'Enter a field mapping.',
      'Search properties': 'Search properties',
      'Search fields': 'Search fields',
      'No fields found for mapping.': 'No fields found for mapping.',
      'No custom fields found for mapping.':
        'No custom fields found for mapping.',
      'Search connectors': 'Search connectors',
      Type: 'Type',
      'None selected': 'None selected',
      'Map a property to': 'Map a property to',
      'Mapping removed.': 'Mapping removed.',
      'Select a source property from your':
        'Select a source property from your',
      'data to the': 'data to the',
      field: 'field',
      'Map properties from your': 'Map properties from your',
      'data to one of the fields below': 'data to one of the fields below',
      'Signed in': 'Signed in',
      Save: 'Save',
      'Trying to connect...': 'Trying to connect...',
      'Connection failed': 'Connection failed',
      'Could not connect to {{connectionName}}. Please check your credentials':
        'Could not connect to {{connectionName}}. Please check your credentials.',
      'Need help? View our': 'Need help? View our',
      'Connection Guide': 'Connection Guide',
      'Successfully connected to {{connectionName}}':
        'Successfully connected to {{connectionName}}',
      'Please provide default values for the fields below. These will be applied when creating new {{selectedResource}} through our integration.':
        'Please provide default values for the fields below. These will be applied when creating new {{selectedResource}} through our integration.',
      'Configure the {{name}} integration in the':
        'Configure the {{name}} integration in the',
      'before linking your account. This integration will not be visible to your users until configured.':
        'before linking your account. This integration will not be visible to your users until configured.',
      'Something went wrong': 'Something went wrong',
      'The integration could not be authorized. Please make sure your settings are correct and try again.':
        'The integration could not be authorized. Please make sure your settings are correct and try again.',
      Authorize: 'Authorize',
      'Missing required fields': 'Missing required fields',
      'Missing required field mappings.': 'Missing required field mappings.',
      'Field Mapping': 'Field Mapping',
      'Admin configuration required': 'Admin configuration required',
      enabled: 'enabled',
      disabled: 'disabled',
      'settings are updated': 'settings are updated',
      'Updating failed': 'Updating failed',
      '{{connectionName}} is deleted': '{{connectionName}} is deleted',
      'Configurable Resources': 'Configurable Resources',
      'Re-authorize': 'Re-authorize',
      Disable: 'Disable',
      Enable: 'Enable',
      Disconnect: 'Disconnect',
      Delete: 'Delete',
      Close: 'Close',
      Connection: 'Connection',
      'Are you sure?': 'Are you sure?',
    },
  },
  nl: {
    translation: {
      Added: 'Toegevoegd',
      Available: 'Beschikbaar',
      'Manage your integrations': 'Beheer je integraties',
      'No integrations found': 'Geen integraties gevonden',
      'No integrations have been added yet':
        'Er zijn nog geen integraties beschikbaar gesteld door de applicatie eigenaar',
      'No connections': 'Geen connecties',
      'Search integrations': 'Zoek integraties',
      'Needs configuration': 'Configuratie nodig',
      'Invalid configuration': 'Ongeldige configuratie',
      'Not connected': 'Niet verbonden',
      Disabled: 'Uitgeschakeld',
      Unauthorized: 'Ongeautoriseerd',
      'Input required': 'Input vereist',
      Connected: 'Verbonden',
      Loading: 'Laden',
      'Select..': 'Selecteer..',
      Example: 'Voorbeeld',
      'Select field': 'Selecteer field',
      'Select custom field': 'Selecteer custom field',
      'Enter a field mapping.': 'Voer een mapping in.',
      'Search properties': 'Zoek properties',
      'Search fields': 'Zoek fields',
      'No fields found for mapping.': 'Geen fields gevonden voor mapping.',
      'No custom fields found for mapping.':
        'Geen custom fields gevonden voor mapping.',
      'Search connectors': 'Zoek connectors',
      Type: 'Type',
      'None selected': 'Geen geselecteerd',
      'Map a property to': 'Map een property naar',
      'Mapping removed.': 'Mapping verwijderd.',
      'Select a source property from your':
        'Selecteer een bron property van je',
      'data to the': 'data naar de',
      field: 'field',
      'Map properties from your': 'Map properties van je',
      'data to one of the fields below':
        'data naar een van de onderstaande fields',
      'Signed in': 'Ingelogd',
      Save: 'Opslaan',
      'Trying to connect...': 'Verbinding maken...',
      'Connection failed': 'Verbinding mislukt',
      'Could not connect to {{connectionName}}. Please check your credentials':
        'Kon geen verbinding maken met {{connectionName}}. Controleer je credentials.',
      'Need help? View our': 'Hulp nodig? Bekijk onze',
      'Connection Guide': 'Connection Guide',
      'Successfully connected to {{connectionName}}':
        'Verbonden met {{connectionName}}',
      'Please provide default values for the fields below. These will be applied when creating new {{selectedResource}} through our integration.':
        'Vul hieronder standaardwaarden in voor de velden. Deze worden toegepast wanneer je nieuwe "{{selectedResource}}" maakt via onze integratie.',
      'Configure the {{name}} integration in the':
        'Configureer de {{name}} integratie in het',
      'before linking your account. This integration will not be visible to your users until configured.':
        'voordat je je account koppelt. Deze integratie is niet zichtbaar voor je gebruikers totdat deze is geconfigureerd.',
      'Something went wrong': 'Er is iets misgegaan',
      'The integration could not be authorized. Please make sure your settings are correct and try again.':
        'De integratie kon niet worden geautoriseerd. Controleer of je instellingen correct zijn en probeer het opnieuw.',
      Authorize: 'Autoriseren',
      'Missing required fields': 'Ontbrekende verplichte velden',
      'Missing required field mappings.':
        'Ontbrekende verplichte veldmappings.',
      'Field Mapping': 'Veldmapping',
      'Admin configuration required': 'Admin configuratie vereist',
      enabled: 'ingeschakeld',
      disabled: 'uitgeschakeld',
      'settings are updated': 'instellingen zijn bijgewerkt',
      'Updating failed': 'Bijwerken mislukt',
      '{{connectionName}} is deleted': '{{connectionName}} is verwijderd',
      'Configurable Resources': 'Configruabelen Resources',
      'Re-authorize': 'Opnieuw autoriseren',
      Disable: 'Uitschakelen',
      Enable: 'Inschakelen',
      Disconnect: 'Ontkoppelen',
      Delete: 'Verwijderen',
      Close: 'Sluiten',
      Connection: 'Connectie',
      'When you delete a connection you will lose all your configured settings.':
        'Wanneer je een connectie verwijdert, verlies je al je geconfigureerde instellingen.',
    },
  },
};

i18n.use(initReactI18next).init({
  resources,
  lng: 'en',
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
